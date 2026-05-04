from __future__ import annotations

from ..repositories.base import GenericRepository
from ..models.orm.identity import OrganizationUser, APIKey, ProviderCredential


class OrganizationUserRepository(GenericRepository[OrganizationUser]):
    def __init__(self):
        super().__init__(OrganizationUser)


class APIKeyRepository(GenericRepository[APIKey]):
    def __init__(self):
        super().__init__(APIKey)


class ProviderCredentialRepository(GenericRepository[ProviderCredential]):
    def __init__(self):
        super().__init__(ProviderCredential)


