import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderForm, submittedBody } from "./test-utils";

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
  await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
}

describe("SignupForm city field", () => {
  it("does not mark the city select as required", () => {
    renderForm();
    expect(screen.getByLabelText(/עיר/)).not.toBeRequired();
  });

  it("labels the field as optional", () => {
    renderForm();
    expect(screen.getByText("עיר (לא חובה)")).toBeInTheDocument();
  });

  it("offers a selectable, real 'no city' option instead of a disabled placeholder", () => {
    renderForm();
    const blankOption = screen.getByRole("option", { name: "ללא ציון עיר" });
    expect(blankOption).not.toBeDisabled();
  });

  it("omits cityName from the request body when left blank", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body).not.toHaveProperty("cityName");
  });

  it("sends cityName when a city is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillRequiredFields(user);
    await user.selectOptions(screen.getByLabelText(/עיר/), "תל אביב-יפו");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body.cityName).toBe("תל אביב-יפו");
  });

  it("lets the supporter pick a city and then return to 'no city'", async () => {
    const user = userEvent.setup();
    renderForm();
    const select = screen.getByLabelText<HTMLSelectElement>(/עיר/);
    await user.selectOptions(select, "תל אביב-יפו");
    expect(select.value).toBe("תל אביב-יפו");
    await user.selectOptions(select, "");
    expect(select.value).toBe("");
  });
});
