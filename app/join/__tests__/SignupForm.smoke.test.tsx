import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fillNameAndPhone, renderForm, selectCity, submittedBody } from "./test-utils";

describe("SignupForm smoke test", () => {
  it("renders the form immediately, with no network calls on mount", () => {
    const fetchMock = renderForm();
    expect(screen.getByLabelText("שם מלא")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /תנאי השימוש ולמדיניות הפרטיות/ })).toBeRequired();
    expect(screen.getByRole("link", { name: "תנאי השימוש ולמדיניות הפרטיות" })).toHaveAttribute(
      "href",
      "https://amchaisrael.co.il/privacy"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks an unchecked submission with a Hebrew alert and sends explicit consent when checked", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillNameAndPhone(user);
    await selectCity(user, "תל אביב-יפו");

    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("יש לאשר את תנאי השימוש ומדיניות הפרטיות");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("checkbox", { name: /תנאי השימוש ולמדיניות הפרטיות/ }));
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    expect(submittedBody(fetchMock).privacyAccepted).toBe(true);
  });
});
