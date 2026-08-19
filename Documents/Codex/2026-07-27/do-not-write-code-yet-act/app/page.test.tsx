import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("displays the product name and live transition analysis", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("FormationFlow");
    expect(html).toContain("Transition analysis");
    expect(html).toContain("Safety conflicts");
    expect(html).toContain("Path intersections");
    expect(html).not.toContain("No analysis yet");
  });
});
