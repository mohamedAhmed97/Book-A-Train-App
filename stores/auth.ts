import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ATHLETE" | "COACH";
  avatar?: string | null;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token) => {
    await AsyncStorage.setItem("bat_token", token);
    await AsyncStorage.setItem("bat_user", JSON.stringify(user));
    set({ user, token });
  },

  clearAuth: async () => {
    await AsyncStorage.multiRemove(["bat_token", "bat_user"]);
    set({ user: null, token: null });
  },

  loadFromStorage: async () => {
    try {
      const [token, userJson] = await AsyncStorage.multiGet(["bat_token", "bat_user"]);
      const t = token[1];
      const u = userJson[1];
      if (t && u) set({ token: t, user: JSON.parse(u) as AuthUser });
    } finally {
      set({ isLoading: false });
    }
  },
}));
