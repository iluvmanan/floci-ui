# 07 — Developer Tools

CloudFormation · Step Functions · AppSync · AppConfig · CodeBuild · CodeDeploy

All paths under `Resources → Developer`.

---

## CloudFormation

**Location:** `Resources → Developer → CloudFormation`

### Create a stack
**Create Stack**

| Field | Example value |
|-------|---------------|
| Stack name | `demo-stack` |
| Template body (JSON/YAML) | see below |
| Parameters (optional) | none |

```json
{
  "Resources": {
    "DemoBucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": { "BucketName": "cfn-demo-bucket" }
    }
  }
}
```

Open a stack → **Events** timeline, **Resources** list, **Outputs** table.
**Update** with a new template, or **Delete**.

---

## Step Functions

**Location:** `Resources → Developer → Step Functions`

### Create a state machine
**Create State Machine**

| Field | Example value |
|-------|---------------|
| Name | `demo-sm` |
| Type | `STANDARD` (or `EXPRESS`) |
| Role ARN | `arn:aws:iam::000000000000:role/demo-role` |
| Definition (ASL JSON) | see below |

```json
{
  "Comment": "demo",
  "StartAt": "Hello",
  "States": {
    "Hello": { "Type": "Pass", "Result": "done", "End": true }
  }
}
```

### Run it (open a state machine)
**Start Execution** → input `{}` (or `{"key":"value"}`). Execution history lists
status; open one to see input/output.

---

## AppSync

**Location:** `Resources → Developer → AppSync`

### Create a GraphQL API
**Create API**

| Field | Example value |
|-------|---------------|
| Name | `demo-gql` |
| Authentication type | `API_KEY` |

Open an API → **Schema** (SDL viewer), **Data Sources** (name `demo-ddb`, type
`AMAZON_DYNAMODB`), **Resolvers** tab.

---

## AppConfig

**Location:** `Resources → Developer → AppConfig`
Tabbed page: **Applications · Environments · Config Profiles · Deployments**.

### Create an application
Applications tab → **Create Application**

| Field | Example value |
|-------|---------------|
| Name | `demo-appconfig` |
| Description (optional) | `demo` |

Then (open the app):
- **Environment** → name `dev`.
- **Configuration profile** → name `feature-flags`, location URI `hosted`.
- **Deployment** → environment `dev`, profile `feature-flags`, strategy `AppConfig.AllAtOnce`.

---

## CodeBuild

**Location:** `Resources → Developer → CodeBuild`

### Create a project
**Create Project**

| Field | Example value |
|-------|---------------|
| Name | `demo-build` |
| Source type | `NO_SOURCE` (or `GITHUB` + repo URL) |
| Environment image | `aws/codebuild/standard:7.0` |
| Compute type | `BUILD_GENERAL1_SMALL` |
| Environment type | `LINUX_CONTAINER` |
| Service role ARN | `arn:aws:iam::000000000000:role/demo-role` |
| Artifacts type | `NO_ARTIFACTS` |

Open a project → **Start build** (optional env var overrides). Build history shows
status/phase/duration.

---

## CodeDeploy

**Location:** `Resources → Developer → CodeDeploy`

### Create an application
**Create Application**

| Field | Example value |
|-------|---------------|
| Application name | `demo-deploy` |
| Compute platform | `Server` (also `Lambda`, `ECS`) |

Then (open the app):
- **Deployment group** → name `demo-dg`, service role ARN `arn:aws:iam::000000000000:role/demo-role`, config `CodeDeployDefault.OneAtATime`.
- **Create deployment** → revision from S3 (`demo-bucket` / `app.zip`). Deployment
  history shows status.
