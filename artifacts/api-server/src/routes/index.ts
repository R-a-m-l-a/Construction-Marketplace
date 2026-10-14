import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import discoveryRouter from "./discovery.js";
import estimatesRouter from "./estimates.js";
import locationsRouter from "./locations.js";
import marketplaceRouter from "./marketplace.js";
import projectBriefsRouter from "./project-briefs.js";
import professionalsRouter from "./professionals.js";
import professionalProjectsRouter from "./professional-projects.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(discoveryRouter);
router.use(estimatesRouter);
router.use(locationsRouter);
router.use(marketplaceRouter);
router.use(projectBriefsRouter);
router.use(professionalsRouter);
router.use(professionalProjectsRouter);

export default router;
