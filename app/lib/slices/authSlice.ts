import {
  Action,
  Dispatch,
  PayloadAction,
  ThunkDispatch,
  createSlice,
  current,
} from "@reduxjs/toolkit"
import {
  IEnableTOTP,
  IUserOpenProfileCreate,
  IUserProfile,
  IUserProfileUpdate,
  IWebToken,
} from "../interfaces"
import { RootState } from "../store"
import { tokenIsTOTP, tokenParser } from "../utilities"
import { addNotice, deleteNotices } from "./toastsSlice"
import { apiAuth } from "../api"
import {
  setMagicToken,
  deleteTokens,
  getTokens,
  validateMagicTokens,
  validateTOTPClaim,
} from "./tokensSlice"
import { PURGE, purgeStoredState } from "redux-persist"
import { perstistor } from "../reduxProvider"

interface AuthState {
  id: string
  email: string
  email_validated: boolean
  is_active: boolean
  is_superuser: boolean
  fullName: string
  password: boolean
  totp: boolean
}

const initialState: AuthState = {
  id: "",
  email: "",
  email_validated: false,
  is_active: false,
  is_superuser: false,
  fullName: "",
  password: false,
  totp: false,
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUserProfile: (state: AuthState, action: PayloadAction<IUserProfile>) => {
      state.id = action.payload.id
      state.email = action.payload.email
      state.email_validated = action.payload.email_validated
      state.is_active = action.payload.is_active
      state.is_superuser = action.payload.is_superuser
      state.fullName = action.payload.fullName
      state.password = action.payload.password
      state.totp = action.payload.totp
    },
    setTOTPAuthentication: (
      state: AuthState,
      action: PayloadAction<boolean>,
    ) => {
      state.totp = action.payload
    },
    setEmailValidation: (state: AuthState, action: PayloadAction<boolean>) => {
      state.email_validated = action.payload
    },
    deleteAuth: () => {
      return initialState
    },
  },
})

export const {
  setUserProfile,
  setTOTPAuthentication,
  setEmailValidation,
  deleteAuth,
} = authSlice.actions

export const isAdmin = (state: RootState) => {
  return state.auth.id && state.auth.is_superuser && state.auth.is_active
}
export const profile = (state: RootState) => state.auth
export const loggedIn = (state: RootState) => state.auth.id !== ""

export const login =
  (payload: { username: string; password?: string }) =>
  async (
    dispatch: ThunkDispatch<any, void, Action>,
    getState: () => RootState,
  ) => {
    try {
      await dispatch(getTokens(payload))
      const token = getState().tokens.access_token
      await dispatch(getUserProfile(token))
    } catch (error) {
      dispatch(
        addNotice({
          title: "Login error",
          content:
            "Please check your details or internet connection and try again.",
          icon: "error",
        }),
      )
    }
  }

export const magicLogin =
  (payload: { token: string }) =>
  async (
    dispatch: ThunkDispatch<any, void, Action>,
    getState: () => RootState,
  ) => {
    try {
      await dispatch(validateMagicTokens(payload.token))
      const token = getState().tokens.access_token
      await dispatch(getUserProfile(token))
    } catch (error) {
      dispatch(
        addNotice({
          title: "Login error",
          content:
            "Please check your details or internet connection and try again.",
          icon: "error",
        }),
      )
      dispatch(logout())
    }
  }

export const totpLogin =
  (payload: { claim: string }) =>
  async (
    dispatch: ThunkDispatch<any, void, Action>,
    getState: () => RootState,
  ) => {
    try {
      await dispatch(validateTOTPClaim(payload.claim))
      const token = getState().tokens.access_token
      await dispatch(getUserProfile(token))
    } catch (error) {
      dispatch(
        addNotice({
          title: "Login error",
          content:
            "Please check your details or internet connection and try again.",
          icon: "error",
        }),
      )
      dispatch(logout())
    }
  }

export const logout = () => (dispatch: Dispatch) => {
  dispatch(deleteAuth())
  dispatch(deleteTokens())
  dispatch(deleteNotices())
  dispatch({
    type: PURGE,
    key: "root",
    result: () => null,
  })
}

export const getUserProfile =
  (token: string) => async (dispatch: ThunkDispatch<any, void, Action>) => {
    if (token && !tokenIsTOTP(token)) {
      try {
        const res = await apiAuth.getProfile(token)
        if (res) dispatch(setUserProfile(res))
      } catch (error) {
        dispatch(
          addNotice({
            title: "Login error",
            content:
              "Please check your details, or internet connection, and try again.",
            icon: "error",
          }),
        )
        dispatch(logout())
      }
    }
  }

export const createUserProfile =
  (payload: IUserOpenProfileCreate) => async (dispatch: Dispatch) => {
    try {
      const res = await apiAuth.createProfile(payload)
      if (res) dispatch(setUserProfile(res))
    } catch (error) {
      dispatch(
        addNotice({
          title: "Login creation error",
          content:
            "Please check your details, or internet connection, and try again.",
          icon: "error",
        }),
      )
    }
  }

export const updateUserProfile =
  (payload: IUserProfileUpdate) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (loggedIn(currentState) && currentState.tokens.access_token) {
      try {
        const res = await apiAuth.updateProfile(
          currentState.tokens.access_token,
          payload,
        )
        if (res) {
          dispatch(setUserProfile(res))
          dispatch(
            addNotice({
              title: "Profile update",
              content: "Your settings have been updated.",
            }),
          )
        } else throw "Error"
      } catch (error) {
        dispatch(
          addNotice({
            title: "Profile update error",
            content:
              "Please check your submission, or internet connection, and try again.",
            icon: "error",
          }),
        )
      }
    }
  }

export const enableTOTPAuthentication =
  (payload: IEnableTOTP) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (loggedIn(currentState) && currentState.tokens.access_token) {
      try {
        const res = await apiAuth.enableTOTPAuthentication(
          currentState.tokens.access_token,
          payload,
        )
        if (res) {
          dispatch(setTOTPAuthentication(true))
          dispatch(
            addNotice({
              title: "Two-factor authentication",
              content: res.msg,
            }),
          )
        } else throw "Error"
      } catch (error) {
        dispatch(
          addNotice({
            title: "Error enabling two-factor authentication",
            content:
              "Please check your submission, or internet connection, and try again.",
            icon: "error",
          }),
        )
      }
    }
  }

export const disableTOTPAuthentication =
  (payload: IUserProfileUpdate) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (loggedIn(currentState) && currentState.tokens.access_token) {
      try {
        const res = await apiAuth.disableTOTPAuthentication(
          currentState.tokens.access_token,
          payload,
        )
        if (res) {
          dispatch(setTOTPAuthentication(false))
          dispatch(
            addNotice({
              title: "Two-factor authentication",
              content: res.msg,
            }),
          )
        } else throw "Error"
      } catch (error) {
        dispatch(
          addNotice({
            title: "Error disabling two-factor authentication",
            content:
              "Please check your submission, or internet connection, and try again.",
            icon: "error",
          }),
        )
      }
    }
  }

export const sendEmailValidation =
  () => async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (
      currentState.tokens.access_token &&
      !currentState.auth.email_validated
    ) {
      try {
        const res = await apiAuth.requestValidationEmail(
          currentState.tokens.access_token,
        )
        if (res) {
          dispatch(
            addNotice({
              title: "Validation sent",
              content: res.msg,
            }),
          )
        } else throw "Error"
      } catch (error) {
        dispatch(
          addNotice({
            title: "Validation error",
            content: "Please check your email and try again.",
            icon: "error",
          }),
        )
      }
    }
  }

export const validateEmail =
  (validationToken: string) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (
      currentState.tokens.access_token &&
      !currentState.auth.email_validated
    ) {
      try {
        const res = await apiAuth.validateEmail(
          currentState.tokens.access_token,
          validationToken,
        )
        if (res) {
          dispatch(setEmailValidation(true))
          dispatch(
            addNotice({
              title: "Success",
              content: res.msg,
            }),
          )
        } else throw "Error"
      } catch (error) {
        dispatch(
          addNotice({
            title: "Validation error",
            content: "Invalid token. Check your email and resend validation.",
            icon: "error",
          }),
        )
      }
    }
  }

export const recoverPassword =
  (email: string) => async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (!loggedIn(currentState)) {
      try {
        const res = await apiAuth.recoverPassword(email)
        if (res) {
          if (res.hasOwnProperty("claim"))
            dispatch(setMagicToken(res as unknown as IWebToken))
          dispatch(
            addNotice({
              title: "Success",
              content:
                "If that login exists, we'll send you an email to reset your password.",
            }),
          )
        } else throw "Error"
      } catch (error) {
        dispatch(
          addNotice({
            title: "Login error",
            content:
              "Please check your details, or internet connection, and try again.",
            icon: "error",
          }),
        )
        dispatch(deleteTokens())
      }
    }
  }

export const resetPassword =
  (password: string, token: string) =>
  async (dispatch: Dispatch, getState: () => RootState) => {
    const currentState = getState()
    if (!loggedIn(currentState)) {
      try {
        const claim: string = currentState.tokens.access_token
        // Check the two magic tokens meet basic criteria
        const localClaim = tokenParser(claim)
        const magicClaim = tokenParser(token)
        if (
          localClaim.hasOwnProperty("fingerprint") &&
          magicClaim.hasOwnProperty("fingerprint") &&
          localClaim["fingerprint"] === magicClaim["fingerprint"]
        ) {
          const res = await apiAuth.resetPassword(password, claim, token)
          if (res)
            dispatch(
              addNotice({
                title: "Success",
                content: res.msg,
              }),
            )
          else throw "Error"
        }
      } catch (error) {
        dispatch(
          addNotice({
            title: "Login error",
            content:
              "Ensure you're using the same browser and that the token hasn't expired.",
            icon: "error",
          }),
        )
        dispatch(deleteTokens())
      }
    }
  }

export default authSlice.reducer
