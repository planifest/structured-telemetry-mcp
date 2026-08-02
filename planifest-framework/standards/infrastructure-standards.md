# Planifest Infrastructure Standards

---

## 1. Infrastructure as Code

- All infrastructure must be defined in code - no manual console changes
- Use the IaC tool declared in the stack (Terraform, Pulumi, CDK)
- IaC files live at `src/{component-id}/infra/` or a dedicated infrastructure component
- All configuration is parameterized - no hardcoded values for environment, region, or credentials

---

## 2. Environment Separation

- Environment-specific values use variables/parameters, never conditional logic in IaC
- Production infrastructure changes require human approval

---

## 3. Compute

- Use the compute model declared in the stack (Cloud Run, Lambda, ECS, K8s)
- Configure auto-scaling based on metrics identified in the SLO definitions
