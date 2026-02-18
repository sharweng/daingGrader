"""
Web Module Package
==================
Contains all web-specific features:
- Authentication (signup/login with JWT)
- E-commerce (products, orders, cart)
- Payments (PayMongo integration)
- Community (forum posts, comments)
- Contact form
- Email notifications
"""

from .auth import router as auth_router, _get_current_user, JWT_SECRET, JWT_ALGORITHM
from .payment import router as payment_router
from .contact import router as contact_router

__all__ = [
    'auth_router',
    'payment_router', 
    'contact_router',
    '_get_current_user',
    'JWT_SECRET',
    'JWT_ALGORITHM',
]