import { Router, type IRouter } from "express";
import {
  GetDiscoveryStatsResponse,
  ListCategoriesResponse,
  ListFeaturedProfessionalsResponse,
  ListFeaturedProductsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const categories = [
  {
    id: "cement",
    name: "Cement",
    group: "Materials",
    icon: "layers",
    description: "Compare everyday cement and concrete essentials.",
  },
  {
    id: "steel",
    name: "Steel",
    group: "Materials",
    icon: "building-2",
    description: "Find reinforcement steel and structural supplies.",
  },
  {
    id: "tiles",
    name: "Tiles",
    group: "Finishing",
    icon: "grid-2x2",
    description: "Browse floors, walls, and outdoor tile options.",
  },
  {
    id: "electrical",
    name: "Electrical",
    group: "Services",
    icon: "zap",
    description: "Source dependable wiring, fixtures, and help.",
  },
  {
    id: "plumbing",
    name: "Plumbing",
    group: "Services",
    icon: "droplets",
    description: "Get pipes, fittings, and plumbing support.",
  },
  {
    id: "solar",
    name: "Solar",
    group: "Systems",
    icon: "sun",
    description: "Explore solar components and installation help.",
  },
  {
    id: "paint",
    name: "Paint",
    group: "Finishing",
    icon: "paintbrush",
    description: "Plan color, protection, and surface finishing.",
  },
  {
    id: "hardware",
    name: "Hardware",
    group: "Materials",
    icon: "wrench",
    description: "Find the small parts that keep a build moving.",
  },
];

const professionals = [
  {
    id: "demo-atelier-architects",
    name: "Northline Atelier",
    category: "Architect",
    city: "Islamabad",
    rating: 4.9,
    yearsExperience: 12,
    verified: true,
    source: "Buildora demo profile",
    description: "Residential planning and climate-conscious home design.",
  },
  {
    id: "demo-solid-ground",
    name: "Solid Ground Works",
    category: "Contractor",
    city: "Lahore",
    rating: 4.7,
    yearsExperience: 9,
    verified: true,
    source: "Buildora demo profile",
    description: "Grey structure, site coordination, and build supervision.",
  },
  {
    id: "demo-circuit-craft",
    name: "Circuit Craft",
    category: "Electrician",
    city: "Rawalpindi",
    rating: 4.8,
    yearsExperience: 7,
    verified: false,
    source: "Buildora demo profile",
    description: "Residential wiring, load planning, and safe installations.",
  },
];

const products = [
  {
    id: "demo-cement-store",
    name: "Everyday Cement 50kg",
    category: "Cement",
    supplier: "Demo Cement Store",
    city: "Islamabad",
    priceLabel: "Price on request",
    description: "Fictional demo listing for testing marketplace flows.",
  },
  {
    id: "demo-steel-traders",
    name: "Grade 60 Reinforcement Steel",
    category: "Steel",
    supplier: "Demo Steel Traders",
    city: "Lahore",
    priceLabel: "Range available",
    description: "Fictional demo listing for testing marketplace flows.",
  },
  {
    id: "demo-tiles-center",
    name: "Textured Exterior Tiles",
    category: "Tiles",
    supplier: "Demo Tiles Center",
    city: "Rawalpindi",
    priceLabel: "Price on request",
    description: "Fictional demo listing for testing marketplace flows.",
  },
];

router.get("/categories", (_req, res) => {
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/professionals/featured", (_req, res) => {
  res.json(ListFeaturedProfessionalsResponse.parse(professionals));
});

router.get("/products/featured", (_req, res) => {
  res.json(ListFeaturedProductsResponse.parse(products));
});

router.get("/discovery/stats", (_req, res) => {
  res.json(
    GetDiscoveryStatsResponse.parse({
      marketplaceItems: products.length,
      professionalCategories: 12,
      citiesCovered: 3,
      demoNotice:
        "Marketplace examples are fictional demo listings. Real-world discovery will be added with free map search.",
    }),
  );
});

export default router;