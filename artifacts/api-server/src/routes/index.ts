import { Router, type IRouter } from "express";
import healthRouter from "./health";
import discoveryRouter from "./discovery";
import estimatesRouter from "./estimates";
import locationsRouter from "./locations";
import marketplaceRouter from "./marketplace";
import projectBriefsRouter from "./project-briefs";
import professionalsRouter from "./professionals";
import professionalProjectsRouter from "./professional-projects";

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
