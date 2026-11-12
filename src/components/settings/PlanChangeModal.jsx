import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import Modal from "../Modal";
import "../Modal.css";
import "./SettingsExtra.css";
import LoadStateNotice from "../LoadStateNotice";
import useServerResource from "../../hooks/useServerResource";
import { getSubscriptionPlans, changeSubscriptionPlan } from "../../api/settingsApi";

// 요금제 변경 (WEB-F-061) — 요금제 목록은 서버에서 받는다
function PlanChangeModal({ currentPlan, onClose, onChanged }) {
  const { data: plans, source, errorMessage } = useServerResource(getSubscriptionPlans);

  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const planList = plans ?? [];
  const current = planList.find((plan) => plan.name === currentPlan);
  const selected =
    planList.find((plan) => plan.id === selectedId) ?? current ?? planList[0] ?? null;

  const isSame = !selected || selected.name === currentPlan;
  const isUpgrade = current && selected && selected.price > current.price;

  async function handleConfirm() {
    setSaving(true);
    setSaveError("");

    try {
      await changeSubscriptionPlan(selected.id);
      onChanged(selected);
      onClose();
    } catch (error) {
      setSaveError(error.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="요금제 변경"
      width={760}
      onClose={onClose}
      footer={
        <>
          <span className={`plan-footer-note ${saveError ? "error" : ""}`.trim()}>
            {saveError ||
              (!selected
                ? ""
                : isSame
                  ? "현재 이용 중인 요금제입니다."
                  : isUpgrade
                    ? "업그레이드는 즉시 적용되며 차액이 일할 계산되어 청구됩니다."
                    : "다운그레이드는 다음 결제일부터 적용됩니다.")}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleConfirm}
            disabled={isSame || saving}
          >
            {saving ? "변경 중..." : selected ? `${selected.name}(으)로 변경` : "변경"}
          </button>
        </>
      }
    >
      {!plans ? (
        <LoadStateNotice source={source} subject="요금제 목록을" message={errorMessage} />
      ) : (
        <div className="plan-grid">
          {planList.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className={`plan-card ${selected?.id === plan.id ? "selected" : ""}`}
              onClick={() => setSelectedId(plan.id)}
            >
              {plan.name === currentPlan && <span className="plan-current">현재 요금제</span>}

              <strong className="plan-name">{plan.name}</strong>
              <span className="plan-price">
                ₩{Number(plan.price ?? 0).toLocaleString()}
                <small>/월</small>
              </span>

              <ul>
                {(plan.features ?? []).map((feature) => (
                  <li key={feature}>
                    <FiCheck />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default PlanChangeModal;
