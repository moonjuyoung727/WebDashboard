import { useState } from "react";
import Toggle from "../../components/Toggle";
import LoadStateNotice from "../../components/LoadStateNotice";
import PlanChangeModal from "../../components/settings/PlanChangeModal";
import PaymentMethods from "../../components/settings/PaymentMethods";
import useServerResource from "../../hooks/useServerResource";
import { getSubscription, updateAutoRenew } from "../../api/settingsApi";
import "./Settings.css";

// 구독 설정 (WEB-F-061)
function SubscriptionSettings() {
  const { data: subscription, source, errorMessage, setData } = useServerResource(getSubscription);
  const [saveError, setSaveError] = useState("");

  // 요금제 변경 모달
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  if (!subscription) {
    return (
      <div className="settings-section">
        <h2>구독 설정</h2>
        <LoadStateNotice source={source} subject="구독 정보를" message={errorMessage} />
      </div>
    );
  }

  // 바꾸면 서버에 바로 저장하고, 실패하면 이전 값으로 되돌린다
  async function handleAutoRenew() {
    const newValue = !subscription.autoRenew;

    setSaveError("");
    setData((prev) => ({ ...prev, autoRenew: newValue }));

    try {
      await updateAutoRenew(newValue);
    } catch (error) {
      setData((prev) => ({ ...prev, autoRenew: !newValue }));
      setSaveError(error.message);
    }
  }

  return (
    <div className="settings-section">
      <h2>구독 설정</h2>

      {saveError && <p className="settings-error" role="alert">{saveError}</p>}

      <div className="setting-card">
        <div>
          <strong>현재 요금제</strong>
          <p>현재 이용 중인 구독 요금제입니다.</p>
        </div>

        <span className="subscription-value">{subscription.plan || "-"}</span>
      </div>

      <div className="setting-card">
        <div>
          <strong>구독 상태</strong>
          <p>현재 구독 서비스 이용 상태입니다.</p>
        </div>

        <span className="subscription-status">
          {subscription.status === "active" ? "이용 중" : "만료"}
        </span>
      </div>

      <div className="setting-card">
        <div>
          <strong>다음 결제일</strong>
          <p>다음 구독 결제 예정일입니다.</p>
        </div>

        <span className="subscription-value">{subscription.nextPaymentDate || "-"}</span>
      </div>

      <div className="setting-card">
        <div>
          <strong>자동 갱신</strong>
          <p>구독 기간 종료 시 현재 요금제를 자동으로 갱신합니다.</p>
        </div>

        <Toggle checked={Boolean(subscription.autoRenew)} onChange={handleAutoRenew} />
      </div>

      <div className="setting-card">
        <div>
          <strong>요금제 변경</strong>
          <p>현재 이용 중인 구독 요금제를 변경합니다.</p>
        </div>

        <button
          type="button"
          className="settings-button"
          onClick={() => setIsPlanModalOpen(true)}
        >
          요금제 변경
        </button>
      </div>

      {/* WEB-F-061 결제 수단 관리 */}
      <PaymentMethods />

      {isPlanModalOpen && (
        <PlanChangeModal
          currentPlan={subscription.plan}
          onClose={() => setIsPlanModalOpen(false)}
          onChanged={(plan) => setData((prev) => ({ ...prev, plan: plan.name }))}
        />
      )}
    </div>
  );
}

export default SubscriptionSettings;
