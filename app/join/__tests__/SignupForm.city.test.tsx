import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderForm, submittedBody } from "./test-utils";

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/שם מלא/), "ישראל ישראלי");
  await user.type(screen.getByLabelText(/טלפון נייד/), "0501234567");
}

async function selectCity(user: ReturnType<typeof userEvent.setup>, cityName: string) {
  const combobox = screen.getByRole("combobox");
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name: cityName }));
}

describe("SignupForm city field", () => {
  it("does not mark the city combobox as required", () => {
    renderForm();
    expect(screen.getByLabelText(/עיר/)).not.toBeRequired();
  });

  it("labels the field as optional", () => {
    renderForm();
    expect(screen.getByText("עיר (לא חובה)")).toBeInTheDocument();
  });

  it("offers a selectable, real 'no city' option instead of a disabled placeholder", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("combobox"));
    const blankOption = screen.getByRole("option", { name: "ללא ציון עיר" });
    expect(blankOption).not.toHaveAttribute("aria-disabled", "true");
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
    await selectCity(user, "תל אביב-יפו");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body.cityName).toBe("תל אביב-יפו");
  });

  it("lets the supporter pick a city and then return to 'no city'", async () => {
    const user = userEvent.setup();
    renderForm();
    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await selectCity(user, "תל אביב-יפו");
    expect(combobox.value).toBe("תל אביב-יפו");

    await selectCity(user, "ללא ציון עיר");
    expect(combobox.value).toBe("");
  });

  it("filters the option list as the supporter types", async () => {
    const user = userEvent.setup();
    renderForm();
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.type(combobox, "חיפ");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByRole("option", { name: "חיפה" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "תל אביב-יפו" })).not.toBeInTheDocument();
    // The "no city" option stays available regardless of the search text.
    expect(within(listbox).getByRole("option", { name: "ללא ציון עיר" })).toBeInTheDocument();
  });

  it("shows a no-results message when the search matches nothing", async () => {
    const user = userEvent.setup();
    renderForm();
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.type(combobox, "zzzzz");

    expect(screen.getByText("לא נמצאו ערים תואמות")).toBeInTheDocument();
  });

  it("selects the highlighted option on Enter after arrowing down", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillRequiredFields(user);
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.type(combobox, "חיפה");
    await user.keyboard("{ArrowDown}{Enter}");

    expect((combobox as HTMLInputElement).value).toBe("חיפה");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    expect(submittedBody(fetchMock).cityName).toBe("חיפה");
  });

  it("closes without changing the value on Escape", async () => {
    const user = userEvent.setup();
    renderForm();
    const combobox = screen.getByRole<HTMLInputElement>("combobox");
    await user.click(combobox);
    await user.type(combobox, "חיפה");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox.value).toBe("");
  });
});
