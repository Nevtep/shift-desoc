type Router = {
  push: (path: string) => Promise<void> | void
  replace: (path: string) => Promise<void> | void
  prefetch: (path: string) => Promise<void> | void
  refresh: () => void
  back: () => void
  forward: () => void
};

const router: Router = {
  push: async () => {},
  replace: async () => {},
  prefetch: async () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
};

export const useRouter = (): Router => router;
export const usePathname = (): string => "/";
export const useSearchParams = (): URLSearchParams => new URLSearchParams();
export const useParams = (): Record<string, string> => ({});
export const redirect = (_url: string) => {
  throw new Error("redirect is not supported in Storybook");
};
export const notFound = () => {
  throw new Error("notFound is not supported in Storybook");
};
