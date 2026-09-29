from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/search/", views.search, name="search"),
    path("api/reverse/", views.reverse, name="reverse"),
    path("api/forecast/", views.forecast, name="forecast"),
    path("api/analytics/", views.analytics_api, name="analytics"),
    path("tiles/<str:layer>/<int:z>/<int:x>/<int:y>.png", views.tile, name="tile"),
]
