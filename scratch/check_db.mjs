import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase URL:", supabaseUrl);

const { data, error } = await supabase.from("companies").select("*").limit(1);
if (error) {
  console.error("Error fetching companies:", error);
} else {
  console.log("Success! Columns in companies:", Object.keys(data[0] || {}));
}
