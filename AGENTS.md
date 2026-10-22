<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Private app: every page lives under `src/routes/_authenticated/` (home is `_authenticated/index.tsx`, no public `/`); login at `/auth`. Why: nothing should be visible signed-out.
- Data (items, outfits, outfit_items, profiles) is read/written from the browser Supabase client with owner RLS; photos are in the private `wardrobe` bucket under `<user_id>/` and shown via signed URLs. Why: single-user data, RLS is the boundary.
- AI stylist runs only in `src/lib/chat.functions.ts` (authenticated server fn, Responses API, structured output); item ids returned by the model are filtered against the user's items. Why: keep the key server-side and never show invented items.
- Theme: `.dark` class on `<html>` set from localStorage by an inline head script (`src/lib/theme.ts`). Why: no flash on load.
