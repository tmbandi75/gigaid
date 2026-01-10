import { Input } from "@/components/ui/input";
import { formatUSPhone } from "@/lib/phoneFormat";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  "data-testid"?: string;
}

export function PhoneInput({ value, onChange, className, placeholder = "(555) 000-0000", ...props }: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatUSPhone(e.target.value);
    onChange(formatted);
  };

  return (
    <Input
      type="tel"
      value={formatUSPhone(value)}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
}
