import { createClient } from "@supabase/supabase-js";
import { findById, update } from "../lib/db.js";

// Load env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

console.log("Supabase URL:", supabaseUrl);

// Let's get any company ID
const supabase = createClient(supabaseUrl, supabaseKey);
const { data: companies } = await supabase.from("companies").select("id").limit(1);
const companyId = companies?.[0]?.id;

if (!companyId) {
  console.log("No companies in DB to test.");
  process.exit(0);
}

console.log("Testing with Company ID:", companyId);

// 1. Fetch
const c1 = await findById("companies", companyId);
console.log("c1 termsAndConditions:", c1.termsAndConditions);
console.log("c1 invoiceTemplate:", c1.invoiceTemplate);

// 2. Update with template
const templateObj = { globalFont: "Courier New", wordStyles: { Siddhi: { color: "#ff0000" } } };
const updated1 = await update("companies", companyId, {
  invoiceTemplate: JSON.stringify(templateObj)
});

console.log("After Template Update:");
console.log("updated1 termsAndConditions:", updated1.termsAndConditions);
console.log("updated1 invoiceTemplate:", updated1.invoiceTemplate);

// 3. Update with terms only (simulating profile form edit)
const updated2 = await update("companies", companyId, {
  termsAndConditions: "New Custom Terms & Conditions"
});

console.log("After Terms Update:");
console.log("updated2 termsAndConditions:", updated2.termsAndConditions);
console.log("updated2 invoiceTemplate:", updated2.invoiceTemplate);

// Verify that the template was preserved!
const parsedTemplate = JSON.parse(updated2.invoiceTemplate);
if (parsedTemplate.globalFont === "Courier New") {
  console.log("SUCCESS! Template was preserved when terms were updated.");
} else {
  console.error("FAIL! Template was lost!");
}
