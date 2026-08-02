import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Link/router com prefixo de idioma automático.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
