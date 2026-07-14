import { ListboxPicker } from '../../ui/ListboxPicker'

type ScaleOption = {
  id: string
  name: string
}

type ScalePickerProps = {
  options: ScaleOption[]
  selectedId: string | null
  selectedName: string
  disabled: boolean
  onSelect: (id: string) => Promise<void>
}

export function ScalePicker({
  options,
  selectedId,
  selectedName,
  disabled,
  onSelect,
}: ScalePickerProps) {
  return (
    <ListboxPicker
      options={options}
      selectedId={selectedId}
      selectedName={selectedName}
      disabled={disabled}
      triggerLabel="Select active scale"
      listLabel="Available scales"
      onSelect={onSelect}
    />
  )
}
