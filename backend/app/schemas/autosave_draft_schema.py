import json
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator


MAX_AUTOSAVE_PAYLOAD_BYTES = 2 * 1024 * 1024


class AutosaveDraftUpsert(BaseModel):
    payload: JsonValue
    expected_revision: int = Field(
        default=0,
        ge=0,
        description="Zero creates a new draft; existing drafts require their current revision.",
    )

    @field_validator("payload")
    @classmethod
    def limit_payload_size(cls, value: JsonValue) -> JsonValue:
        encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > MAX_AUTOSAVE_PAYLOAD_BYTES:
            raise ValueError("Autosave draft payload exceeds the 2 MiB limit")
        return value


class AutosaveDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scope: str
    entity_key: str
    payload: JsonValue
    revision: int
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
