import { useState } from "react";
import { FiCreditCard, FiTrash2 } from "react-icons/fi";
import Modal from "../Modal";
import "../Modal.css";
import "./SettingsExtra.css";
import LoadStateNotice from "../LoadStateNotice";
import useServerResource from "../../hooks/useServerResource";
import {
  getPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from "../../api/settingsApi";

// 결제 수단 관리 (WEB-F-061)
// 카드 번호는 직접 입력받지 않고 PG사 결제창에서 등록 → 서버는 빌링키만 보관
// 변경 · 삭제는 서버에 반영한 뒤 목록을 다시 불러온다
function PaymentMethods() {
  const { data: methods, source, errorMessage, refresh } = useServerResource(getPaymentMethods);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function runAction(id, action) {
    setPendingId(id);
    setActionError("");

    try {
      await action();
      await refresh();
      return true;
    } catch (error) {
      setActionError(error.message);
      return false;
    } finally {
      setPendingId(null);
    }
  }

  function handleSetDefault(id) {
    runAction(id, () => setDefaultPaymentMethod(id));
  }

  async function handleDelete(id) {
    if (await runAction(id, () => deletePaymentMethod(id))) {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="payment-section">
      <div className="payment-header">
        <div>
          <strong>결제 수단</strong>
          <p>구독 요금이 청구될 결제 수단을 관리합니다.</p>
        </div>
      </div>

      {!methods && (
        <LoadStateNotice source={source} subject="결제 수단을" message={errorMessage} />
      )}

      {actionError && !deleteTarget && (
        <p className="settings-error" role="alert">{actionError}</p>
      )}

      {methods && methods.length === 0 && (
        <p className="payment-empty">등록된 결제 수단이 없습니다.</p>
      )}

      {methods && (
        <ul className="payment-list">
          {methods.map((method) => (
            <li key={method.id} className={method.isDefault ? "default" : ""}>
              <FiCreditCard className="payment-icon" />

              <div className="payment-info">
                <strong>
                  {method.brand} •••• {method.last4}
                </strong>
                <small>만료 {method.expiry}</small>
              </div>

              {method.isDefault ? (
                <span className="payment-default-badge">기본 결제 수단</span>
              ) : (
                <button
                  type="button"
                  className="btn small"
                  disabled={pendingId !== null}
                  onClick={() => handleSetDefault(method.id)}
                >
                  {pendingId === method.id ? "변경 중..." : "기본으로 설정"}
                </button>
              )}

              <button
                type="button"
                className="payment-delete"
                disabled={pendingId !== null}
                onClick={() => {
                  setActionError("");
                  setDeleteTarget(method);
                }}
                aria-label="결제 수단 삭제"
              >
                <FiTrash2 />
              </button>
            </li>
          ))}
        </ul>
      )}


      {deleteTarget && (
        <Modal
          title="결제 수단 삭제"
          width={420}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={pendingId !== null}
                onClick={() => handleDelete(deleteTarget.id)}
              >
                {pendingId === deleteTarget.id ? "삭제 중..." : "삭제"}
              </button>
            </>
          }
        >
          <p className="payment-modal-text">
            {deleteTarget.brand} •••• {deleteTarget.last4} 결제 수단을 삭제하시겠습니까?
            {deleteTarget.isDefault && (
              <>
                <br />
                기본 결제 수단을 삭제하면 다른 결제 수단이 기본으로 지정됩니다.
              </>
            )}
          </p>
          {actionError && <p className="settings-error" role="alert">{actionError}</p>}
        </Modal>
      )}
    </div>
  );
}

export default PaymentMethods;
