/** Signs in to a local preview server with an emailed code; returns the cookie. */
export async function signIn(origin, email = "owner@cafe.test") {
  const headers = { origin, "content-type": "application/json" };
  const requested = await fetch(origin + "/api/auth/request-code", {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });
  const { devCode } = await requested.json();
  const verified = await fetch(origin + "/api/auth/verify", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, code: devCode }),
  });
  const { user } = await verified.json();
  return {
    cookie: verified.headers.get("set-cookie").split(";")[0],
    userId: user.id,
  };
}
