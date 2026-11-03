/** Any /api address that is not a real endpoint gets a plain JSON 404, not the app page. */
export const onRequest: PagesFunction = async () => Response.json({ error: 'Not found.' }, { status: 404 });
