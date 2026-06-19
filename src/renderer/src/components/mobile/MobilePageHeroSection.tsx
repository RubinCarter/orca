import { PhoneCarousel } from './PhoneCarousel'
import {
  HeroFlow,
  HeroIntro,
  HeroPaired,
  type PairedDevice,
  type Platform,
  type StepIndex
} from './MobileHero'
import { PLATFORM_COPY } from './mobile-platform-copy'
import type { MobileNetworkInterface } from '../settings/mobile-network-interface-selection'
import type { MobilePageStage } from './mobile-page-stage'
import { translate } from '@/i18n/i18n'

type MobilePageHeroSectionProps = {
  stage: MobilePageStage | null
  stepIdx: StepIndex
  platform: Platform
  installQrUrl: string | null
  pairQrDataUrl: string | null
  pairingUrl: string | null
  pairLoading: boolean
  networkInterfaces: MobileNetworkInterface[]
  selectedAddress: string | undefined
  refreshingNetworkInterfaces: boolean
  devices: PairedDevice[]
  revokingDeviceIds: string[]
  onStart: () => void
  onPairAnother: () => void
  onRevoke: (deviceId: string) => void
  onPlatformChange: (platform: Platform) => void
  onOpenInstallUrl: () => void
  onCopyInstallUrl: () => void
  onRegeneratePairing: () => void
  onCopyPairingCode: () => void
  onSelectedAddressChange: (address: string) => void
  onRefreshNetworkInterfaces: () => void
  onBack: () => void
  onContinue: () => void
  onDone: (() => void) | undefined
}

export function MobilePageHeroSection({
  stage,
  stepIdx,
  platform,
  installQrUrl,
  pairQrDataUrl,
  pairingUrl,
  pairLoading,
  networkInterfaces,
  selectedAddress,
  refreshingNetworkInterfaces,
  devices,
  revokingDeviceIds,
  onStart,
  onPairAnother,
  onRevoke,
  onPlatformChange,
  onOpenInstallUrl,
  onCopyInstallUrl,
  onRegeneratePairing,
  onCopyPairingCode,
  onSelectedAddressChange,
  onRefreshNetworkInterfaces,
  onBack,
  onContinue,
  onDone
}: MobilePageHeroSectionProps): React.JSX.Element {
  return (
    <section className="mp-hero">
      <div className="mp-hero-copy">
        {stage === null ? null : stage === 'intro' ? (
          <HeroIntro onStart={onStart} />
        ) : stage === 'paired' ? (
          <HeroPaired
            devices={devices}
            onPairAnother={onPairAnother}
            onRevoke={onRevoke}
            revokingDeviceIds={revokingDeviceIds}
          />
        ) : (
          <HeroFlow
            stepIdx={stepIdx}
            platform={platform}
            onPlatformChange={onPlatformChange}
            installQrUrl={installQrUrl}
            installCopy={PLATFORM_COPY[platform]}
            onOpenInstallUrl={onOpenInstallUrl}
            onCopyInstallUrl={onCopyInstallUrl}
            pairQrDataUrl={pairQrDataUrl}
            pairingUrl={pairingUrl}
            pairLoading={pairLoading}
            onRegeneratePairing={onRegeneratePairing}
            onCopyPairingCode={onCopyPairingCode}
            networkInterfaces={networkInterfaces}
            selectedAddress={selectedAddress}
            onSelectedAddressChange={onSelectedAddressChange}
            onRefreshNetworkInterfaces={onRefreshNetworkInterfaces}
            refreshingNetworkInterfaces={refreshingNetworkInterfaces}
            onBack={onBack}
            onContinue={onContinue}
            onDone={onDone}
          />
        )}
      </div>
      <div
        className="mp-stage"
        aria-label={translate('auto.components.mobile.MobilePage.e17393c6a3', 'Phone preview')}
      >
        <PhoneCarousel />
      </div>
    </section>
  )
}
