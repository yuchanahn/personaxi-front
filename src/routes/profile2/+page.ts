import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ url }) => {
    const target = new URL("/profile", url);
    target.search = url.search;

    throw redirect(308, `${target.pathname}${target.search}`);
};
