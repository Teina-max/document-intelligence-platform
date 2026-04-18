import { cookies } from "next/headers";
import { LOCALE_COOKIE, getLocaleFromCookie, type Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return getLocaleFromCookie(cookieStore.get(LOCALE_COOKIE)?.value);
}
