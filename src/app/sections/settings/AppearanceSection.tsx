import { Icon } from '../../ui/Icon'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { Switch } from '../../ui/Switch'
import { useTheme } from '../../theme/useTheme'
import { usePreferences } from '../../preferences/usePreferences'
import type { ThemePreference } from '../../theme/theme'

const themeOptions = [
  { value: 'light', label: 'Light', description: 'Always use the light appearance' },
  { value: 'system', label: 'System', description: 'Follow the operating system appearance' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark appearance' },
] as const satisfies readonly {
  value: ThemePreference
  label: string
  description: string
}[]

export function AppearanceSection() {
  const { preference, resolvedTheme, setPreference } = useTheme()
  const { workspaceLayout, setWorkspaceLayout, busy, error } = usePreferences()

  return (
    <section className="appearanceSection" aria-labelledby="appearance-title">
      <div className="settingsSectionIntro">
        <div>
          <h3 id="appearance-title">Appearance</h3>
          <p>Choose how XenSequencer fits into your studio environment.</p>
        </div>
      </div>
      <div className="appearanceCard">
        <div className="appearanceCardHeader">
          <div>
            <h4>Color theme</h4>
            <p>
              {preference === 'system'
                ? `Following the system, currently ${resolvedTheme}.`
                : `Using ${resolvedTheme} mode.`}
            </p>
          </div>
          <div className={`appearancePreview appearancePreview-${resolvedTheme}`} aria-hidden="true">
            <Icon name={resolvedTheme === 'dark' ? 'moon' : 'sun'} size={20} />
          </div>
        </div>
        <SegmentedControl
          className="appearanceThemeControl"
          label="Color theme"
          value={preference}
          options={themeOptions}
          onChange={setPreference}
          disabled={busy}
        />
      </div>
      <div className="appearanceCard">
        <div className="appearanceCardHeader">
          <div>
            <h4>Dual editor view</h4>
            <p>
              Show Sequence above Composition when enough vertical space is available.
              Smaller windows show only the active editor.
            </p>
          </div>
          <Switch
            className="appearanceLayoutSwitch"
            label="Dual editor view"
            checked={workspaceLayout === 'dual'}
            disabled={busy}
            onChange={(checked) => setWorkspaceLayout(
              checked ? 'dual' : 'single'
            )}
          />
        </div>
      </div>
      {error ? <p className="settingsError" role="alert">{error}</p> : null}
      <p className="appearanceNote">
        System mode updates automatically when your operating system appearance changes.
      </p>
    </section>
  )
}
