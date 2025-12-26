/**
 * Test script for Stripe Billing Meters
 *
 * Usage:
 *   pnpm tsx scripts/test-meters.ts --create-customer
 *   pnpm tsx scripts/test-meters.ts --subscribe <customer_id>
 *   pnpm tsx scripts/test-meters.ts <customer_id>
 *   pnpm tsx scripts/test-meters.ts --preview <customer_id>
 *   pnpm tsx scripts/test-meters.ts --bill-now <customer_id>
 */

import Stripe from "stripe";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Price IDs from your .env
const PRICE_IDS = {
  functionCalls: process.env.STRIPE_CONVEX_FUNCTION_CALLS_PRICE_ID,
  actionCompute: process.env.STRIPE_CONVEX_ACTION_COMPUTE_PRICE_ID,
  databaseBandwidth: process.env.STRIPE_CONVEX_DB_BANDWIDTH_PRICE_ID,
  databaseStorage: process.env.STRIPE_CONVEX_DB_STORAGE_PRICE_ID,
  fileBandwidth: process.env.STRIPE_CONVEX_FILE_BANDWIDTH_PRICE_ID,
  fileStorage: process.env.STRIPE_CONVEX_FILE_STORAGE_PRICE_ID,
  vectorBandwidth: process.env.STRIPE_CONVEX_VECTOR_BANDWIDTH_PRICE_ID,
  vectorStorage: process.env.STRIPE_CONVEX_VECTOR_STORAGE_PRICE_ID,
};

const METER_EVENTS = [
  { name: "convex_function_calls", value: 1000 },
  { name: "convex_action_compute", value: 5000 },
  { name: "convex_database_bandwidth", value: 100 },
  { name: "convex_database_storage", value: 50 },
  { name: "convex_file_bandwidth", value: 200 },
  { name: "convex_file_storage", value: 100 },
  { name: "convex_vector_bandwidth", value: 10 },
  { name: "convex_vector_storage", value: 5 },
];

async function createCustomer() {
  // Create customer
  const customer = await stripe.customers.create({
    name: "Test Customer",
    email: "test@example.com",
    metadata: { source: "test-meters-script" },
  });

  // Attach a test payment method
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      token: "tok_visa", // Test token for Visa
    },
  });

  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customer.id,
  });

  await stripe.customers.update(customer.id, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  console.log(`Created test customer: ${customer.id}`);
  console.log(`Attached test Visa card as default payment method`);
  console.log(`\nNext steps:`);
  console.log(`  1. pnpm tsx scripts/test-meters.ts --subscribe ${customer.id}`);
  console.log(`  2. pnpm tsx scripts/test-meters.ts ${customer.id}`);
  console.log(`  3. pnpm tsx scripts/test-meters.ts --bill-now ${customer.id}`);
}

async function addPaymentMethod(customerId: string) {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      token: "tok_visa",
    },
  });

  await stripe.paymentMethods.attach(paymentMethod.id, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethod.id,
    },
  });

  console.log(`✓ Attached test Visa card to ${customerId}`);
}

async function createSubscription(customerId: string) {
  const priceIds = Object.values(PRICE_IDS).filter(Boolean) as string[];

  if (priceIds.length === 0) {
    console.error("No price IDs configured in .env");
    console.log("Required variables:");
    Object.keys(PRICE_IDS).forEach((key) => console.log(`  STRIPE_CONVEX_${key.toUpperCase()}_PRICE_ID`));
    return;
  }

  console.log(`Creating subscription with ${priceIds.length} metered prices...\n`);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: priceIds.map((price) => ({ price })),
    payment_behavior: "default_incomplete",
  });

  console.log(`✓ Created subscription: ${subscription.id}`);
  console.log(`  Status: ${subscription.status}`);
  console.log(`\nNow send meter events:`);
  console.log(`  pnpm tsx scripts/test-meters.ts ${customerId}`);
}

async function sendMeterEvents(customerId: string) {
  console.log(`Sending meter events for customer: ${customerId}\n`);

  for (const event of METER_EVENTS) {
    try {
      await stripe.billing.meterEvents.create({
        event_name: event.name,
        payload: {
          stripe_customer_id: customerId,
          value: event.value.toString(),
        },
      });
      console.log(`✓ ${event.name}: ${event.value}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${event.name}: ${msg}`);
    }
  }

  console.log("\nDone! Check Stripe Dashboard:");
  console.log("  Billing → Meters → Click a meter → Event log");
  console.log(`  Customers → ${customerId} → Upcoming invoice`);
}

async function previewInvoice(customerId: string) {
  // Get the customer's subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    console.log("No subscription found. Create one first:");
    console.log(`  pnpm tsx scripts/test-meters.ts --subscribe ${customerId}`);
    return;
  }

  const subscription = subscriptions.data[0];

  console.log("Fetching upcoming invoice preview...\n");

  const preview = await stripe.invoices.retrieveUpcoming({
    customer: customerId,
    subscription: subscription.id,
  });

  console.log(`Upcoming Invoice Preview`);
  console.log(`========================`);
  console.log(`Subtotal: $${(preview.subtotal / 100).toFixed(4)}`);
  console.log(`Total: $${(preview.total / 100).toFixed(4)}`);
  console.log(`\nLine items:`);

  for (const line of preview.lines.data) {
    const amount = (line.amount / 100).toFixed(4);
    const qty = line.quantity ?? 0;
    console.log(`  ${line.description}: ${qty} units = $${amount}`);
  }
}

async function billNow(customerId: string) {
  // Get the customer's subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    console.log("No subscription found.");
    return;
  }

  const subscription = subscriptions.data[0];
  console.log(`Billing subscription ${subscription.id} now...\n`);

  // Reset the billing cycle to now - this creates an invoice for usage so far
  const updated = await stripe.subscriptions.update(subscription.id, {
    billing_cycle_anchor: "now",
    proration_behavior: "none",
  });

  console.log(`✓ Billing cycle reset`);
  console.log(`  New period: ${new Date(updated.current_period_start * 1000).toLocaleDateString()} - ${new Date(updated.current_period_end * 1000).toLocaleDateString()}`);

  // Get the invoice that was just created
  const invoices = await stripe.invoices.list({
    customer: customerId,
    subscription: subscription.id,
    limit: 1,
  });

  if (invoices.data.length > 0) {
    const invoice = invoices.data[0];
    console.log(`\n✓ Invoice created: ${invoice.id}`);
    console.log(`  Status: ${invoice.status}`);
    console.log(`  Amount: $${(invoice.amount_due / 100).toFixed(2)}`);
    if (invoice.hosted_invoice_url) {
      console.log(`  URL: ${invoice.hosted_invoice_url}`);
    }
  }
}

async function fullTest() {
  console.log("=== Full Billing Test ===\n");

  // 1. Create customer with payment method
  console.log("1. Creating customer with test card...");
  const customer = await stripe.customers.create({
    name: "Test Customer " + Date.now(),
    email: "test@example.com",
    metadata: { source: "test-meters-script" },
  });

  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });

  await stripe.paymentMethods.attach(paymentMethod.id, { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });
  console.log(`   ✓ Customer: ${customer.id}\n`);

  // 2. Create subscription
  console.log("2. Creating subscription...");
  const priceIds = Object.values(PRICE_IDS).filter(Boolean) as string[];
  if (priceIds.length === 0) {
    console.log("   ✗ No price IDs configured in .env");
    return;
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: priceIds.map((price) => ({ price })),
  });
  console.log(`   ✓ Subscription: ${subscription.id}\n`);

  // 3. Send meter events
  console.log("3. Sending meter events...");
  for (const event of METER_EVENTS) {
    await stripe.billing.meterEvents.create({
      event_name: event.name,
      payload: {
        stripe_customer_id: customer.id,
        value: event.value.toString(),
      },
    });
    console.log(`   ✓ ${event.name}: ${event.value}`);
  }
  console.log();

  // 4. Wait for Stripe to process events (poll until ALL usage shows up)
  console.log("4. Waiting for Stripe to process meter events...");
  let preview;
  let attempts = 0;
  const maxAttempts = 60; // Up to 2 minutes

  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 2000));

    preview = await stripe.invoices.retrieveUpcoming({
      customer: customer.id,
      subscription: subscription.id,
    });

    const linesWithUsage = preview.lines.data.filter((line) => (line.quantity ?? 0) > 0).length;
    const totalLines = preview.lines.data.length;

    if (linesWithUsage === totalLines) {
      console.log(`   ✓ All ${totalLines} meters processed after ${attempts * 2}s\n`);
      break;
    }
    process.stdout.write(`   ${linesWithUsage}/${totalLines} meters processed (${attempts * 2}s)...\r`);
  }

  if (attempts >= maxAttempts) {
    const linesWithUsage = preview!.lines.data.filter((line) => (line.quantity ?? 0) > 0).length;
    console.log(`   ⚠ Timed out - only ${linesWithUsage}/${preview!.lines.data.length} meters processed\n`);
  }

  // 5. Preview invoice
  console.log("5. Invoice preview:");
  console.log(`   Subtotal: $${(preview!.subtotal / 100).toFixed(4)}`);
  console.log(`   Total: $${(preview!.total / 100).toFixed(4)}`);
  for (const line of preview!.lines.data) {
    const amount = (line.amount / 100).toFixed(4);
    const qty = line.quantity ?? 0;
    console.log(`   - ${line.description}: ${qty} units = $${amount}`);
  }
  console.log();

  // 6. Bill now
  console.log("6. Creating final invoice...");
  const updated = await stripe.subscriptions.update(subscription.id, {
    billing_cycle_anchor: "now",
    proration_behavior: "none",
  });

  const invoices = await stripe.invoices.list({
    customer: customer.id,
    subscription: subscription.id,
    limit: 1,
  });

  if (invoices.data.length > 0) {
    const invoice = invoices.data[0];
    console.log(`   ✓ Invoice: ${invoice.id}`);
    console.log(`   Status: ${invoice.status}`);
    console.log(`   Amount: $${(invoice.amount_due / 100).toFixed(2)}`);
    if (invoice.hosted_invoice_url) {
      console.log(`   URL: ${invoice.hosted_invoice_url}`);
    }
  }

  console.log("\n=== Test Complete ===");
  console.log(`Customer ID: ${customer.id}`);
  console.log(`Subscription ID: ${subscription.id}`);
}

async function listCustomers() {
  console.log("Usage:");
  console.log("  pnpm tsx scripts/test-meters.ts --test                     # full automated test");
  console.log("  pnpm tsx scripts/test-meters.ts --create-customer");
  console.log("  pnpm tsx scripts/test-meters.ts --add-card <customer_id>");
  console.log("  pnpm tsx scripts/test-meters.ts --subscribe <customer_id>");
  console.log("  pnpm tsx scripts/test-meters.ts <customer_id>              # send meter events");
  console.log("  pnpm tsx scripts/test-meters.ts --preview <customer_id>");
  console.log("  pnpm tsx scripts/test-meters.ts --bill-now <customer_id>\n");
  console.log("Available customers:");
  const customers = await stripe.customers.list({ limit: 10 });
  for (const c of customers.data) {
    console.log(`  ${c.id} - ${c.name || c.email || "(no name)"}`);
  }
}

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];

  if (!arg1) {
    await listCustomers();
  } else if (arg1 === "--test") {
    await fullTest();
  } else if (arg1 === "--create-customer") {
    await createCustomer();
  } else if (arg1 === "--add-card" && arg2) {
    await addPaymentMethod(arg2);
  } else if (arg1 === "--subscribe" && arg2) {
    await createSubscription(arg2);
  } else if (arg1 === "--preview" && arg2) {
    await previewInvoice(arg2);
  } else if (arg1 === "--bill-now" && arg2) {
    await billNow(arg2);
  } else if (arg1.startsWith("cus_")) {
    await sendMeterEvents(arg1);
  } else {
    console.log("Invalid argument. Run without arguments for usage.");
  }
}

main().catch(console.error);
