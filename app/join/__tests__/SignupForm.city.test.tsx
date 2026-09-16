import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { acceptPrivacy, fillNameAndPhone, renderForm, selectCity, submittedBody } from "./test-utils";

describe("SignupForm city field", () => {
  it("marks the city combobox as required", () => {
    renderForm();
    expect(screen.getByLabelText("עיר")).toBeRequired();
  });

  it("labels the field without an optional marker", () => {
    renderForm();
    expect(screen.getByText("עיר")).toBeInTheDocument();
    expect(screen.queryByText(/לא חובה/)).not.toBeInTheDocument();
  });

  it("does not offer a 'no city' option", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("option", { name: "ללא ציון עיר" })).not.toBeInTheDocument();
  });

  it("blocks submission and shows an inline error when city is left blank", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillNameAndPhone(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    expect(await screen.findByText("יש לבחור עיר")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks submission when a city name is typed but not selected from the list", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillNameAndPhone(user);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "חיפה");
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));

    expect(await screen.findByText("יש לבחור עיר")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends cityName when a city is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = renderForm();
    await fillNameAndPhone(user);
    await selectCity(user, "תל אביב-יפו");
    await acceptPrivacy(user);
    await user.click(screen.getByRole("button", { name: "מצטרפ/ת כתומכ/ת" }));
    const body = submittedBody(fetchMock);
    expect(body.cityName).toBe("תל אביב-יפו");
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
    await fillNameAndPhone(user);
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    await user.type(combobox, "חיפה");
    await user.keyboard("{ArrowDown}{Enter}");

    expect((combobox as HTMLInputElement).value).toBe("חיפה");
    await acceptPrivacy(user);
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
