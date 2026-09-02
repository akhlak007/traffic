const VALID_ROLES = new Set(["admin", "officer", "supervisor", "owner", "dmp"]);

export function enforceRole(expectedRole) {
  if (!VALID_ROLES.has(expectedRole)) return "admin";
  const url = new URL(location.href);
  const requestedRole = url.searchParams.get("role");
  if (requestedRole && requestedRole !== expectedRole) {
    url.searchParams.set("role", expectedRole);
    history.replaceState(null, "", url);
  }
  return expectedRole;
}
