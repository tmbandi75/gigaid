export function getAdminApiKey(): string {
  return (
    process.env.GIGAID_ADMIN_API_KEY ||
    process.env.TEST_ADMIN_API_KEY ||
    process.env.ADMIN_API_KEY ||
    "test_admin_key"
  );
}
