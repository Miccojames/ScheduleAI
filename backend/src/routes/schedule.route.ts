import { Router } from "express";
import * as scheduleController from "../controllers/schedule.controller.js";
import * as entryController from "../controllers/entry.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createScheduleSchema, updateScheduleSchema } from "../validators/schedule.js";
import { entryBodySchema, bulkEntrySchema } from "../validators/entry.js";

// Entry routes live under schedule routes (the contract groups them this way).
const router = Router();

router.use(requireAuth);

router.get("/", scheduleController.list);
router.post("/", validate(createScheduleSchema), scheduleController.create);
router.get("/:id", scheduleController.get);
router.get("/:id/ics", scheduleController.ics); // raw text/calendar (no JSON envelope)
router.put("/:id", validate(updateScheduleSchema), scheduleController.update);
router.delete("/:id", scheduleController.remove);

// Entries — note: "/:id/entries/bulk" must be declared BEFORE "/:id/entries/:entryId"
// so "bulk" isn't swallowed by the :entryId param (Express 5 matches in order).
router.get("/:id/entries", entryController.list);
router.post("/:id/entries/bulk", validate(bulkEntrySchema), entryController.bulk);
router.post("/:id/entries", validate(entryBodySchema), entryController.create);
router.put("/:id/entries/:entryId", validate(entryBodySchema), entryController.update);
router.delete("/:id/entries/:entryId", entryController.remove);

export default router;
