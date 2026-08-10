type Approval = {
  taskId:string;
  title:string;
  issueNumber:number|null;
  allowedFiles:string[];
  summary:string;
  proposedChanges:string[];
  validationSteps:string[];
  expiresAt:number;
};

const approvals = new Map<string, Approval>();

export function createFixApproval(value:Omit<Approval,"expiresAt">) {
  const token = crypto.randomUUID();
  approvals.set(token, { ...value, expiresAt:Date.now() + 15 * 60_000 });
  return token;
}

export function consumeFixApproval(token:string, taskId:string) {
  const value = approvals.get(token);
  approvals.delete(token);
  if (!value || value.taskId !== taskId || value.expiresAt < Date.now()) return null;
  return value;
}
