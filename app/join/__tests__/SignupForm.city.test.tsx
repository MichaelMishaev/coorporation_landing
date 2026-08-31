import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderFormReady, submittedBody } from "./test-utils";

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
  await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
}

describe("SignupForm city field", () => {
  it("does not mark the city select as required", async () => {
    await renderFormReady();
    expect(screen.getByLabelText(/עיר/)).not.toBeRequired();
  });

  it("labels the field as optional", async () => {
    await renderFormReady();
    expect(screen.getByText("עיר (לא חובה)")).toBeInTheDocument();
  });

  it("offers a selectable, real 'no city' option instead of a disabled placeholder", async () => {
    await renderFormReady();
    const blankOption = screen.getByRole("option", { name: "ללא ציון עיר" });
    expect(blankOption).not.toBeDisabled();
  });

  it("omits cityId from the request body when left blank", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderFormReady();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body).not.toHaveProperty("cityId");
  });

  it("sends cityId when a city is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = await renderFormReady();
    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText(/עיר/), "city-1");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body.cityId).toBe("city-1");
  });

  it("lets the supporter pick a city and then return to 'no city'", async () => {
    const user = userEvent.setup();
    await renderFormReady();
    const select = screen.getByLabelText<HTMLSelectElement>(/עיר/);
    await user.selectOptions(select, "city-1");
    expect(select.value).toBe("city-1");
    await user.selectOptions(select, "");
    expect(select.value).toBe("");
  });
});
