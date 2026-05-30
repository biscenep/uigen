import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  describe("initial state", () => {
    test("isLoading is false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("calls signInAction with the provided credentials", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "mypassword");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "mypassword");
    });

    test("returns the result from signInAction", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      let returnedResult: Awaited<ReturnType<typeof result.current.signIn>>;
      await act(async () => {
        returnedResult = await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(returnedResult!).toEqual({ success: false, error: "Invalid credentials" });
    });

    test("sets isLoading to true while the action is in-flight", async () => {
      let resolveAction!: (val: unknown) => void;
      (signInAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => { resolveAction = resolve; })
      );
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "proj-1" });

      const { result } = renderHook(() => useAuth());

      let pendingPromise!: Promise<unknown>;
      act(() => {
        pendingPromise = result.current.signIn("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction({ success: true });
        await pendingPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false after a failed sign in", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signInAction throws", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("user@example.com", "password");
        } catch {
          // expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign in fails", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    describe("post sign-in navigation", () => {
      test("saves anon work as a project and navigates to it when anon messages exist", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
          messages: [{ role: "user", content: "Build a button" }],
          fileSystemData: { "/App.jsx": { type: "file", content: "export default () => <button/>" } },
        });
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "anon-proj-1" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: "user", content: "Build a button" }],
            data: { "/App.jsx": { type: "file", content: "export default () => <button/>" } },
          })
        );
        expect(clearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-proj-1");
      });

      test("anon project name contains 'Design from' prefix", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
          messages: [{ role: "user", content: "Make a modal" }],
          fileSystemData: {},
        });
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "anon-proj-2" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: expect.stringContaining("Design from") })
        );
      });

      test("skips getProjects when anon work has messages", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
          messages: [{ role: "user", content: "Hello" }],
          fileSystemData: {},
        });
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "anon-proj" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(getProjects).not.toHaveBeenCalled();
      });

      test("navigates to most recent project when anon work has no messages", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({ messages: [], fileSystemData: {} });
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: "recent-proj" },
          { id: "older-proj" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-proj");
        expect(createProject).not.toHaveBeenCalled();
      });

      test("navigates to most recent project when there is no anon work", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: "proj-a" },
          { id: "proj-b" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/proj-a");
      });

      test("creates a blank project and navigates to it when no anon work and no existing projects", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "brand-new-proj" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/brand-new-proj");
      });

      test("new blank project name contains 'New Design' prefix", async () => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-proj" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: expect.stringContaining("New Design") })
        );
      });
    });
  });

  describe("signUp", () => {
    test("calls signUpAction with the provided credentials", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "newpassword");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "newpassword");
    });

    test("returns the result from signUpAction", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      let returnedResult: Awaited<ReturnType<typeof result.current.signUp>>;
      await act(async () => {
        returnedResult = await result.current.signUp("existing@example.com", "password");
      });

      expect(returnedResult!).toEqual({ success: false, error: "Email already registered" });
    });

    test("sets isLoading to true while the action is in-flight", async () => {
      let resolveAction!: (val: unknown) => void;
      (signUpAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((resolve) => { resolveAction = resolve; })
      );
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "proj-1" });

      const { result } = renderHook(() => useAuth());

      let pendingPromise!: Promise<unknown>;
      act(() => {
        pendingPromise = result.current.signUp("user@example.com", "password");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction({ success: true });
        await pendingPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false after a failed sign up", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password");
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signUpAction throws", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp("user@example.com", "password");
        } catch {
          // expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign up fails", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("navigates to an existing project after successful sign up", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "existing-proj" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password");
      });

      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });

    test("saves anon work as a project and navigates to it after successful sign up", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [{ role: "user", content: "Build a landing page" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "..." } },
      });
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "anon-signup-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Build a landing page" }],
          data: { "/App.jsx": { type: "file", content: "..." } },
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-signup-proj");
    });

    test("creates a blank project after successful sign up with no existing projects", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-user-proj" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("brand@example.com", "password");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-user-proj");
    });
  });
});
