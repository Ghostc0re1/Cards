import { CardBuilderApp } from "./src/app-controller.ts";
import { collectDomRefs } from "./src/app-dom.ts";

const refs = collectDomRefs(document);
const app = new CardBuilderApp({ refs });

app.init().catch((error) => {
  refs.saveStatus.textContent = "Asset load failed";
  console.error(error);
});
