from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class FirstRunResponse(BaseModel):
    is_first_run: bool


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    is_active: bool
