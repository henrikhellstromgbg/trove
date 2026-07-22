export type DeleteState = {
  open: boolean;
  busy: boolean;
  error: string;
};

export type DeleteAction =
  | { type: "open" }
  | { type: "cancel" }
  | { type: "start" }
  | { type: "failure"; error: string }
  | { type: "success" };

export const initialDeleteState: DeleteState = {
  open: false,
  busy: false,
  error: "",
};

export function deleteStateReducer(
  state: DeleteState,
  action: DeleteAction
): DeleteState {
  if (action.type === "open") return { open: true, busy: false, error: "" };
  if (action.type === "cancel") return state.busy ? state : initialDeleteState;
  if (action.type === "start") return { ...state, busy: true, error: "" };
  if (action.type === "failure") {
    return { open: true, busy: false, error: action.error };
  }
  return initialDeleteState;
}
