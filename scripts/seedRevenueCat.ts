import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "GuitarTune";
const APP_STORE_APP_NAME = "GuitarTune iOS";
const APP_STORE_BUNDLE_ID = "com.guitartune.app";
const PLAY_STORE_APP_NAME = "GuitarTune Android";
const PLAY_STORE_PACKAGE_NAME = "com.guitartune.app";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "GuitarTune Premium";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "GuitarTune Plans";

const PRODUCTS = [
  {
    identifier: "guitartune_premium_monthly",
    playStoreIdentifier: "guitartune_premium_monthly:monthly",
    displayName: "GuitarTune Premium Monthly",
    title: "GuitarTune Pro — Monthly",
    duration: "P1M" as const,
    packageKey: "$rc_monthly",
    packageName: "Monthly — $1.99",
    prices: [
      { amount_micros: 1990000, currency: "USD" },
      { amount_micros: 1990000, currency: "EUR" },
    ],
  },
  {
    identifier: "guitartune_premium_annual",
    playStoreIdentifier: "guitartune_premium_annual:annual",
    displayName: "GuitarTune Premium Annual",
    title: "GuitarTune Pro — Annual",
    duration: "P1Y" as const,
    packageKey: "$rc_annual",
    packageName: "Annual — $9.99",
    prices: [
      { amount_micros: 9990000, currency: "USD" },
      { amount_micros: 9990000, currency: "EUR" },
    ],
  },
  {
    identifier: "guitartune_premium_lifetime",
    playStoreIdentifier: "guitartune_premium_lifetime",
    displayName: "GuitarTune Premium Lifetime",
    title: "GuitarTune Pro — Lifetime",
    duration: "P1Y" as const,
    packageKey: "$rc_lifetime",
    packageName: "Lifetime — $14.99",
    prices: [
      { amount_micros: 14990000, currency: "USD" },
      { amount_micros: 14990000, currency: "EUR" },
    ],
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function ensureProduct(
  client: any,
  project: Project,
  targetApp: App,
  label: string,
  productIdentifier: string,
  displayName: string,
  title: string,
  duration: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y",
  isTestStore: boolean,
  existingProducts: { items?: Product[] }
): Promise<Product> {
  const existing = existingProducts.items?.find(
    (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id
  );
  if (existing) {
    console.log(`${label} product already exists:`, existing.id);
    return existing;
  }

  const body: CreateProductData["body"] = {
    store_identifier: productIdentifier,
    app_id: targetApp.id,
    type: "subscription",
    display_name: displayName,
  };

  if (isTestStore) {
    body.subscription = { duration };
    body.title = title;
  }

  const { data: created, error } = await createProduct({
    client,
    path: { project_id: project.id },
    body,
  });
  if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
  console.log(`Created ${label} product:`, created.id);
  return created;
}

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ── Project ──────────────────────────────────────────────────────────────
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // ── Apps ─────────────────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) throw new Error("No apps found");

  let testApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test store app found");
  console.log("Test store app:", testApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: "app_store", app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: "play_store", play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  // ── Products ─────────────────────────────────────────────────────────────
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const allProductIds: string[] = [];

  for (const prod of PRODUCTS) {
    const testProd = await ensureProduct(client, project, testApp, `Test:${prod.identifier}`, prod.identifier, prod.displayName, prod.title, prod.duration, true, existingProducts);
    const iosProd = await ensureProduct(client, project, appStoreApp, `iOS:${prod.identifier}`, prod.identifier, prod.displayName, prod.title, prod.duration, false, existingProducts);
    const androidProd = await ensureProduct(client, project, playStoreApp, `Android:${prod.identifier}`, prod.playStoreIdentifier, prod.displayName, prod.title, prod.duration, false, existingProducts);

    // Test store prices
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProd.id },
      body: { prices: prod.prices },
    });
    if (priceError) {
      if (typeof priceError === "object" && "type" in priceError && priceError["type"] === "resource_already_exists") {
        console.log(`Test store prices already exist for ${prod.identifier}`);
      } else {
        console.warn(`Price warning for ${prod.identifier}:`, JSON.stringify(priceError));
      }
    } else {
      console.log(`Added test store prices for ${prod.identifier}`);
    }

    allProductIds.push(testProd.id, iosProd.id, androidProd.id);
  }

  // ── Entitlement ───────────────────────────────────────────────────────────
  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEnt, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEnt.id);
    entitlement = newEnt;
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });
  if (attachEntErr && attachEntErr.type !== "unprocessable_entity_error") {
    throw new Error("Failed to attach products to entitlement");
  } else {
    console.log("Products attached to entitlement");
  }

  // ── Offering ──────────────────────────────────────────────────────────────
  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOff, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOff.id);
    offering = newOff;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Offering set as current");
  }

  // ── Packages ──────────────────────────────────────────────────────────────
  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  for (const prod of PRODUCTS) {
    let pkg: Package | undefined = existingPackages.items?.find((p) => p.lookup_key === prod.packageKey);
    if (!pkg) {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: prod.packageKey, display_name: prod.packageName },
      });
      if (error) throw new Error(`Failed to create package ${prod.packageKey}`);
      console.log(`Created package ${prod.packageKey}:`, newPkg.id);
      pkg = newPkg;
    } else {
      console.log(`Package ${prod.packageKey} already exists:`, pkg.id);
    }

    // Find the 3 product IDs for this product (test, ios, android)
    const { data: allProds } = await listProducts({
      client,
      path: { project_id: project.id },
      query: { limit: 100 },
    });
    const testProdObj = allProds?.items?.find((p) => p.store_identifier === prod.identifier && p.app_id === testApp!.id);
    const iosProdObj = allProds?.items?.find((p) => p.store_identifier === prod.identifier && p.app_id === appStoreApp!.id);
    const androidProdObj = allProds?.items?.find((p) => p.store_identifier === prod.playStoreIdentifier && p.app_id === playStoreApp!.id);

    if (testProdObj && iosProdObj && androidProdObj) {
      const { error: attachPkgErr } = await attachProductsToPackage({
        client,
        path: { project_id: project.id, package_id: pkg.id },
        body: {
          products: [
            { product_id: testProdObj.id, eligibility_criteria: "all" },
            { product_id: iosProdObj.id, eligibility_criteria: "all" },
            { product_id: androidProdObj.id, eligibility_criteria: "all" },
          ],
        },
      });
      if (attachPkgErr && !attachPkgErr.message?.includes("Cannot attach product")) {
        console.warn(`Package attach warning for ${prod.packageKey}:`, JSON.stringify(attachPkgErr));
      } else {
        console.log(`Attached products to package ${prod.packageKey}`);
      }
    }
  }

  // ── API Keys ──────────────────────────────────────────────────────────────
  const { data: testKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testApp.id } });
  const { data: iosKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } });
  const { data: androidKeys } = await listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } });

  console.log("\n==================================================");
  console.log("✅ RevenueCat setup complete!");
  console.log("Project ID:                ", project.id);
  console.log("Test Store App ID:         ", testApp.id);
  console.log("App Store App ID:          ", appStoreApp.id);
  console.log("Play Store App ID:         ", playStoreApp.id);
  console.log("Entitlement Identifier:    ", ENTITLEMENT_IDENTIFIER);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:    ", testKeys?.items[0]?.key ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:     ", iosKeys?.items[0]?.key ?? "N/A");
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: ", androidKeys?.items[0]?.key ?? "N/A");
  console.log("REVENUECAT_PROJECT_ID:     ", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID:           ", testApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID:      ", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID:    ", playStoreApp.id);
  console.log("==================================================\n");
}

seedRevenueCat().catch(console.error);
