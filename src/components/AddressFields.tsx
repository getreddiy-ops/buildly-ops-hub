import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const emptyAddressParts = { addressCity: "", addressState: "", addressZip: "" };
export type AddressParts = typeof emptyAddressParts & { address: string };

export function formatAddress(parts: AddressParts) {
  const locality = [parts.addressState.trim(), parts.addressZip.trim()].filter(Boolean).join(" ");
  return [parts.address.trim(), [parts.addressCity.trim(), locality].filter(Boolean).join(", ")].filter(Boolean).join("\n");
}

// Only split recognizable locality lines; preserve unfamiliar existing addresses.
export function parseAddress(value: string): AddressParts {
  const match = value.match(/^([\s\S]+)\n([^,\n]+),\s*([A-Za-z ]+?)\s+(\d{5}(?:-\d{4})?)$/);
  return match ? { address: match[1], addressCity: match[2], addressState: match[3], addressZip: match[4] }
    : { address: value, ...emptyAddressParts };
}

// Return individual fields so the shared wizard presents each on its own screen.
export function addressFields(value: AddressParts, onChange: (parts: AddressParts) => void) {
  return ([
    ["address", "Street address", "street-address"],
    ["addressCity", "City", "address-level2"],
    ["addressState", "State", "address-level1"],
    ["addressZip", "ZIP code", "postal-code"],
  ] as const).map(([key, label, autoComplete]) => <div key={key} className="grid gap-1.5">
    <Label>{label}</Label>
    <Input value={value[key]} autoComplete={autoComplete} maxLength={key === "addressZip" ? 10 : 200}
      inputMode={key === "addressZip" ? "numeric" : "text"}
      pattern={key === "addressZip" ? "[0-9]{5}(-[0-9]{4})?" : undefined}
      onChange={event => onChange({ ...value, [key]: event.target.value })} />
  </div>);
}
