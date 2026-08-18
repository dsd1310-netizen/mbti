import { useEffect, useState } from 'react';
import { isNativePlatform, getCreditPackages, CreditPackage } from '../utils/purchases';
import { isTossConfigured, CREDIT_PRICE_OPTIONS, CreditPriceOption } from '../utils/tossPayments';

/**
 * 결제 모달 내부 — 네이티브(RevenueCat 상품 목록)와 웹(토스페이먼츠 정가 옵션)을 분기해 보여준다.
 * 2단계(콘솔에서 상품 등록·API 키 설정)가 아직 안 끝난 상태면 "결제 준비 중" 안내로 우아하게 저하.
 */
export function PaywallOptions({
  loading,
  onPurchaseNative,
  onPurchaseWeb,
}: {
  loading: boolean;
  onPurchaseNative: (identifier: string) => void;
  onPurchaseWeb: (option: CreditPriceOption) => void;
}) {
  const native = isNativePlatform();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packagesLoaded, setPackagesLoaded] = useState(false);

  useEffect(() => {
    if (!native) { setPackagesLoaded(true); return; }
    getCreditPackages().then(pkgs => { setPackages(pkgs); setPackagesLoaded(true); });
  }, [native]);

  if (native) {
    if (!packagesLoaded) {
      return <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>상품 정보를 불러오는 중…</div>;
    }
    if (packages.length === 0) {
      return <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>결제 준비 중이에요. 잠시 후 다시 시도해 주세요.</div>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {packages.map(pkg => (
          <button
            key={pkg.identifier}
            className="btn-gold"
            style={{ justifyContent: 'space-between', padding: '14px 16px' }}
            disabled={loading}
            onClick={() => onPurchaseNative(pkg.identifier)}
          >
            <span>{pkg.productId}</span>
            <span>{pkg.priceString}</span>
          </button>
        ))}
      </div>
    );
  }

  if (!isTossConfigured()) {
    return <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>결제 준비 중이에요. 잠시 후 다시 시도해 주세요.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {CREDIT_PRICE_OPTIONS.map(option => (
        <button
          key={option.amount}
          className="btn-gold"
          style={{ justifyContent: 'center', padding: '14px 16px' }}
          disabled={loading}
          onClick={() => onPurchaseWeb(option)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
