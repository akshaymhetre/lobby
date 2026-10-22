import { deliverMail, type Mail } from "@lobby/core/mail";
import { QUEUES } from "@lobby/core/jobs";
import type { HandlerModule } from "../types";

export const email: HandlerModule = {
  handlers: {
    [QUEUES.sendEmail]: async (mail: Mail) => deliverMail(mail),
  },
};
