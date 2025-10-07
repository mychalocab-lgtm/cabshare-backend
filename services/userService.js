const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserByPhone(phone) {
  const { data, error } = await supabase
    .from("users_app")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (error) console.error("getUserByPhone error:", error.message);
  return data;
}

module.exports = { getUserByPhone };
