const MAX_BATCHES_PER_RUN = 8;

export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },

  async scheduled(controller, env) {
    if (!env.TRANSLATION_CRON_SECRET) {
      console.error("TRANSLATION_CRON_SECRET is not configured");
      return;
    }

    for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
      const response = await fetch(env.SITE_ORIGIN + "/api/exlib/translation/tick", {
        method: "POST",
        headers: { authorization: "Bearer " + env.TRANSLATION_CRON_SECRET },
      });
      if (!response.ok) {
        console.error("Translation tick failed:", response.status);
        return;
      }
      const status = await response.json();
      if (!status.active) return;
    }
  },
};
