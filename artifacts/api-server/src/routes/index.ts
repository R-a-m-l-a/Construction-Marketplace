import { Router, type IRouter } from "express";
import healthRouter from "./health";
import discoveryRouter from "./discovery";
import locationsRouter from "./locations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(discoveryRouter);
router.use(locationsRouter);

export default router;
