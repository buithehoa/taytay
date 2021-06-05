require "test_helper"

class Auth::SpotifyControllerTest < ActionDispatch::IntegrationTest
  test "should get callback" do
    get auth_spotify_callback_url
    assert_response :success
  end
end
