import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fillNameAndPhone, renderForm, selectCity, submittedBody } from "./test-utils";

async function fillOtherRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
}

describe("SignupForm phone field", () => {
  it("only accepts digits, ignoring letters and symbols as they're typed", async () => {
    const user = userEvent.setup();
    renderForm();
    const phone = screen.getByLabelText<HTMLInputElement>(/טלפון נייד/);
    await user.type(phone, "05a0-1b2c3456");
    expect(phone.value.replace(/\D/g, "")).toBe(phone.value.replace(/-/g, ""));
    expect(/^[\d-]*$/.test(phone.value)).toBe(true);
  });

  it("formats the number with a dash after the third digit as the supporter types", async () => {
    const user = userEvent.setup();
    renderForm();
    const phone = screen.getByLabelText<HTMLInputElement>(/טלפון נייד/);
    await user.type(phone, "0501234567");
    expect(phone.value).toBe("050-1234567");
  });

  it("caps input at 10 raw digits even if more are typed", async () => {
    const user = userEvent.setup();
    renderForm();
    const phone = screen.getByLabelText<HTMLInputElement>(/טלפון נייד/);
    await user.type(phone, "050123456789");
    expect(phone.value).toBe("050-1234567");
  });

  it("blocks submission and shows an inline error for a number that isn't a valid Israeli mobile shape", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillOtherRequiredFields(user);
    await user.type(screen.getByLabelText(/טלפון נייד/), "0212345");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    expect(await screen.findByText("מספר טלפון נייד לא תקין. לדוגמה: 050-1234567")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks submission when the phone field is left empty", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillOtherRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    expect(await screen.findByText("מספר טלפון נייד לא תקין. לדוגמה: 050-1234567")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the raw 10-digit phone number, without dashes, on a valid submit", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillNameAndPhone(user);
    await selectCity(user, "תל אביב-יפו");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    const body = submittedBody(fetchMock);
    expect(body.phone).toBe("0501234567");
  });
});
